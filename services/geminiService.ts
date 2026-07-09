import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

import { ConversionResponse, OcrAccuracy } from '../types';

// Set up pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Strips any bytes before the "%PDF-" header and ensures it looks like a PDF.
 * If header is not found, checks for common mislabeled types (like ZIP/Office).
 */
const sanitizePdfBytes = (bytes: Uint8Array): Uint8Array => {
  const zipHeader = [80, 75, 3, 4]; // "PK\x03\x04" (ZIP, Office docs)
  
  // Check if it's actually a ZIP/DOCX masquerading as PDF
  if (bytes.length > 4 && 
      bytes[0] === zipHeader[0] && bytes[1] === zipHeader[1] && 
      bytes[2] === zipHeader[2] && bytes[3] === zipHeader[3]) {
    throw new Error("Šis failas yra ZIP arba Word dokumentas, pervardintas į .pdf. Prašome įkelti tikrą PDF failą.");
  }
  
  return bytes;
};

/**
 * Robustly converts Uint8Array to Base64 string for large files.
 */
const uint8ArrayToBase64 = async (uint8Array: Uint8Array): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Result is "data:application/pdf;base64,...."
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Extracts raw text from a PDF using pdfjs-dist, preserving basic line structure.
 * Returns text partitioned by page.
 */
const extractPageText = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> => {
  const Y_TOLERANCE = 2;
  const X_TOLERANCE = 5;
  try {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    if (items.length === 0) return `--- Puslapis ${pageNum} ---\n(Tuščias puslapis)\n\n`;

    // Sort items by Y then X
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > Y_TOLERANCE) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    let output = `--- Puslapis ${pageNum} ---\n`;
    let lastY = items[0].transform[5];
    let lastX = items[0].transform[4] + items[0].width;

    items.forEach((item) => {
      const x = item.transform[4];
      const y = item.transform[5];
      const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);

      // Vertical gap detection
      const yGap = lastY - y;
      if (yGap > Y_TOLERANCE) {
        // Add double newline for significant gaps (paragraphs)
        output += yGap > fontSize * 1.5 ? "\n\n" : "\n";
        lastX = 0;
      } else if (x - lastX > X_TOLERANCE) {
        // Horizontal gap detection (tabs/columns)
        output += "    "; 
      }

      output += item.str;
      lastY = y;
      lastX = x + item.width;
    });

    return output + "\n\n";
  } catch (e) {
    return `--- Puslapis ${pageNum} ---\n(Teksto ištraukimo klaida)\n\n`;
  }
};

const extractPageImage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, accuracy: OcrAccuracy): Promise<string> => {
  const page = await pdf.getPage(pageNum);
  
  let scale = 2.0;
  let quality = 0.8;
  
  switch(accuracy) {
    case OcrAccuracy.FAST:
      scale = 1.0;
      quality = 0.6;
      break;
    case OcrAccuracy.BALANCED:
      scale = 2.0;
      quality = 0.8;
      break;
    case OcrAccuracy.HIGH:
      scale = 3.0; // Higher scale for better precision
      quality = 0.95;
      break;
  }
  
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Nepavyko sukurti canvas konversijai.");
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  await page.render({ canvasContext: context, viewport: viewport }).promise;
  
  // Return base64 starting after "data:image/jpeg;base64,"
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
};

/**
 * Sends PDF page images to Gemini for OCR when standard PDF parsing fails.
 */
const processImagesChunk = async (
  base64Images: string[], 
  chunkIndex: number, 
  totalChunks: number
): Promise<string> => {
  const prompt = `
    Tu esi profesionalus dokumentų konvertavimo asistentas. 
    Konvertuok šiuos nuskenuotus PDF puslapius (dokumentas be teksto) (segmentas ${chunkIndex + 1} iš ${totalChunks}) į švarų HTML, tinkamą Google Docs.
    Atlik OCR (Optical Character Recognition) ir atpažink tekstą kiekviename puslapyje.

    INSTRUKCIJOS:
    - Išlaikyk struktūrą (h1-h3, p, sąrašai, lentelės).
    - LENTELĖS: Privalai tiksliai renderinti lenteles iš nuskenuoto dokumento. Naudok \`<table style="border-collapse: collapse; width: 100%; margin-bottom: 1.5em; border: 1px solid #d1d5db;">\`, kiekvienam \`<th>\` ir \`<td>\` taikyk \`style="border: 1px solid #d1d5db; padding: 0.75rem; text-align: left;"\`. Jei lentelei tinka antraštinė eilutė, padaryk \`th\` elementus pritaikant papildomą stilių \`background-color: #f9fafb; font-weight: 600;\`. Pritaikius col/row spans pasilengvink darbą jei reikia.
    - Paveikslėliams, schemoms ar grafikams naudok šį placeholderį: <div style="border: 2px dashed #ccc; padding: 10px; text-align: center; margin: 10px 0;">[Paveikslėlio aprašymas lietuviškai]</div>
    - Išversk arba atpažink viską kuo tiksliau, pagal pradinį dokumento vaizdą.
    - Grąžink TIK HTML <body> turinį be \`\`\` blokų.
  `;

  const parts: any[] = base64Images.map(base64 => ({
    inlineData: {
      data: base64,
      mimeType: 'image/jpeg'
    }
  }));
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: { temperature: 0.1 }
  });

  const text = response.text || "";
  return text.replace(/```html/g, '').replace(/```/g, '').trim();
};

/**
 * Sends a PDF chunk to Gemini and requests HTML formatted conversion.
 */
const processChunk = async (
  pdfBytes: Uint8Array, 
  rawText: string, 
  chunkIndex: number, 
  totalChunks: number
): Promise<string> => {
  const prompt = `
    Tu esi profesionalus dokumentų konvertavimo asistentas. 
    Konvertuok pateiktą PDF segmentą (${chunkIndex + 1} iš ${totalChunks}) į švarų HTML, tinkamą Google Docs.

    INSTRUKCIJOS:
    - Ištrauktas pagalbinis tekstas:
    ${rawText.substring(0, 5000)}
    
    - Išlaikyk struktūrą (h1-h3, p, sąrašai, lentelės).
    - LENTELĖS: Privalai tiksliai renderinti lenteles iš PDF. Naudok \`<table style="border-collapse: collapse; width: 100%; margin-bottom: 1.5em; border: 1px solid #d1d5db;">\`, kiekvienam \`<th>\` ir \`<td>\` taikyk \`style="border: 1px solid #d1d5db; padding: 0.75rem; text-align: left;"\`. Jei lentelei tinka antraštinė eilutė, padaryk \`th\` elementus pritaikant papildomą stilių \`background-color: #f9fafb; font-weight: 600;\` išlaikant gražią, estetišką išvaizdą. Jei reikia apjungti eilutes/stulpelius, naudok colspan ir rowspan atributus tinkamai.
    - Paveikslėliams naudok šį placeholderį: <div style="border: 2px dashed #ccc; padding: 10px; text-align: center; margin: 10px 0;">[Paveikslėlio aprašymas lietuviškai]</div>
    - Grąžink TIK HTML <body> turinį be \`\`\` blokų.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            data: await uint8ArrayToBase64(pdfBytes),
            mimeType: 'application/pdf'
          }
        },
        { text: prompt }
      ]
    },
    config: {
      temperature: 0.1
    }
  });

  const text = response.text || "";
  return text.replace(/```html/g, '').replace(/```/g, '').trim();
};

/**
 * Optimized PDF conversion pipeline using chunking to handle larger files.
 */
export const convertPdfToHtml = async (
  file: File, 
  accuracy: OcrAccuracy,
  onProgress?: (message: string, progress?: number) => void
): Promise<ConversionResponse> => {
  if (file.size === 0) throw new Error("Pasirinktas failas yra tuščias.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Maksimalus dydis 20MB.");

  onProgress?.("Pradedama PDF analizė...", 5);
  const arrayBuffer = await file.arrayBuffer();
  let pdfBytes = new Uint8Array(arrayBuffer);
  
  // Sanitize buffer to ensure it starts with %PDF- header
  pdfBytes = sanitizePdfBytes(pdfBytes);
  
  // Load for text extraction and page counting
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdfProxy = await loadingTask.promise;
  const numPages = pdfProxy.numPages;
  
  if (!numPages || numPages <= 0) {
    throw new Error("Nepavyko aptikti puslapių šiame PDF faile. Failas gali būti tuščias arba apsaugotas.");
  }
  
  // Dynamically calculate chunk size based on page count
  // Larger documents use slightly bigger chunks to reduce overhead
  const CHUNK_SIZE = numPages <= 5 ? numPages : (numPages <= 30 ? 8 : 12);
  const totalChunks = Math.ceil(numPages / CHUNK_SIZE);
  let finalHtml = "";

  onProgress?.(`Iš viso puslapių: ${numPages}. Pradedamas apdorojimas segmentais...`, 10);

  // Load for slicing
  let srcDoc;
  let canSlice = true;
  try {
    srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    // Check if we can actually access pages
    if (srcDoc.getPageCount() === 0) {
       canSlice = false;
       console.warn("pdf-lib reported 0 pages, falling back to full file processing.");
    }
  } catch (err) {
    console.warn("PDF slicing (pdf-lib) failed to load, will attempt full-file processing if small enough:", err);
    canSlice = false;
    
    // If it's too large to process in one go (e.g. > 10MB) and we can't slice, we must fail
    if (file.size > 10 * 1024 * 1024) {
      const firstBytes = Array.from(pdfBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.error("Critical PDF Error. First bytes:", firstBytes);
      throw new Error(`Nepavyko nuskaityti PDF struktūros (Header: ${firstBytes}). Failas gali būti per didelis arba apsaugotas. Pabandykite išsaugoti failą iš naujo per 'Print to PDF'.`);
    }
  }

  // If we can't slice, we treat the whole thing as one big chunk
  const actualTotalChunks = canSlice ? totalChunks : 1;
  const actualChunkSize = canSlice ? CHUNK_SIZE : numPages;

  for (let i = 0; i < actualTotalChunks; i++) {
    const startPage = i * actualChunkSize + 1;
    const endPage = Math.min((i + 1) * actualChunkSize, numPages);
    
    const progressPercent = 10 + Math.round((i / actualTotalChunks) * 85);
    onProgress?.(`Apdorojami puslapiai ${startPage}-${endPage} iš ${numPages}...`, progressPercent);

    // 1. Extract text grounding for this chunk (always available from pdfjs)
    let chunkRawText = "";
    for (let p = startPage; p <= endPage; p++) {
      chunkRawText += await extractPageText(pdfProxy, p);
    }

    // 2. Extract PDF slice for this chunk
    let chunkPdfBytesToUpload: Uint8Array;
    let fallbackPdfBytesToUpload = pdfBytes;
    
    if (canSlice && srcDoc && actualTotalChunks > 1) {
      try {
        const chunkDoc = await PDFDocument.create();
        const range = Array.from({ length: endPage - startPage + 1 }, (_, k) => startPage + k - 1);
        const copiedPages = await chunkDoc.copyPages(srcDoc, range);
        
        if (copiedPages.length === 0) {
           throw new Error("No pages copied for this chunk");
        }
        
        copiedPages.forEach(p => chunkDoc.addPage(p));
        chunkPdfBytesToUpload = await chunkDoc.save();
      } catch (sliceErr) {
        console.warn(`Slicing chunk ${i+1} failed, falling back to full file for this chunk:`, sliceErr);
        chunkPdfBytesToUpload = pdfBytes;
      }
    } else {
      // Fallback: Upload the entire original PDF segment if we can't slice
      // This works for Gemini as long as the file isn't massive
      chunkPdfBytesToUpload = pdfBytes;
    }

    // 3. Process with Gemini
    try {
      const chunkHtml = await processChunk(chunkPdfBytesToUpload, chunkRawText, i, actualTotalChunks);
      finalHtml += `<!-- Chunk ${i + 1} -->\n${chunkHtml}\n`;
    } catch (apiErr: any) {
      console.error("Gemini API Error in chunk:", apiErr);
      let errStr = apiErr?.message || apiErr?.toString() || "";
      try { errStr += " " + JSON.stringify(apiErr); } catch (e) {}
      const isMissingPagesErr = errStr.includes("no pages") || errStr.includes("INVALID_ARGUMENT");
      
      if (isMissingPagesErr || errStr.includes("file size is too large") || errStr.includes("Limit")) {
         console.warn("Gemini API rejected the PDF chunk. Falling back strictly to OCR image process...");
         try {
           const base64Images: string[] = [];
           for (let p = startPage; p <= endPage; p++) {
             const pageImage = await extractPageImage(pdfProxy, p, accuracy);
             base64Images.push(pageImage);
           }
           const chunkHtml = await processImagesChunk(base64Images, i, actualTotalChunks);
           finalHtml += `<!-- Chunk ${i + 1} (OCR Image Fallback) -->\n${chunkHtml}\n`;
         } catch (ocrErr: any) {
           console.error("OCR Image Fallback failed:", ocrErr);
           throw new Error("Klaida konvertuojant: nepavyko nuskaityti šio PDF failo apdorojant segmentus.");
         }
      } else {
         // Rethrow cleaner error to UI
         let errorObj = apiErr?.message || errStr;
         try {
           if (typeof errorObj === 'string' && errorObj.startsWith('{')) {
               const parsed = JSON.parse(errorObj);
               if (parsed.error && parsed.error.message) errorObj = parsed.error.message;
           }
         } catch (e) {}
         
         throw new Error(`Klaida konvertuojant (Gemini API): ${errorObj}`);
      }
    }
    
    // Help PDF.js memory
    await pdfProxy.cleanup();
  }

  onProgress?.("Konvertavimas baigtas! Generuojama santrauka ir atpažįstama kalba...", 95);

  let summary = "";
  let language = "";
  try {
    const analysisPrompt = `
      Išanalizuok šį HTML tekstą gautą iš OCR/PDF konvertavimo sistemų.
      1. Nustatykite dokumento originalią kalbą (pvz. "Lietuvių", "Anglų", ir t.t.).
      2. Parašykite glaustą santrauką apie pagrindinius dokumento akcentus (nuo 3 iki 5 sakinių).
      
      Pateikite rezultatą griežtai kaip JSON objektą be jokio papildomo teksto lauke, be markdown backtick'ų. Formatas turi būti:
      {"language": "...", "summary": "..."}

      HTML turinys skiriamas analizei:
      ${finalHtml.substring(0, 50000)}
    `;
    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: analysisPrompt }] },
      config: { temperature: 0.1 }
    });
    const analysisText = (analysisResponse.text || "").replace(/```json/g, '').replace(/```/g, '').trim();
    if (analysisText) {
      const parsed = JSON.parse(analysisText);
      summary = parsed.summary || "";
      language = parsed.language || "";
    }
  } catch (err) {
    console.error("Nepavyko sugeneruoti santraukos:", err);
  }

  onProgress?.("Viskas baigta!", 100);
  return { htmlContent: finalHtml, summary, language };
};
