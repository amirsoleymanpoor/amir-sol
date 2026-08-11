import express from 'express';
import path from 'path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// CORS for mobile app / web client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting: 30 requests per 15 minutes per IP
const inspectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'تعداد درخواست بیش از حد مجاز. لطفاً ۱۵ دقیقه صبر کنید.' },
});

// Body parser with limit
app.use(express.json({ limit: '25mb' }));

// Lazy initializer for Gemini client
let genAIInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.length < 10) {
      throw new Error('کلید GEMINI_API_KEY تنظیم نشده یا نامعتبر است.');
    }
    genAIInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'component-qc-inspector/1.0.0' },
      },
    });
  }
  return genAIInstance;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '1.0.0' });
});

// Base64 validation
function isValidBase64(str: string): boolean {
  if (!str || str.length < 100) return false;
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str);
}

// Component Inspection Endpoint
app.post('/api/inspect-component', inspectLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', componentType = 'برد الکترونیکی PCB', sensitivity = 'medium', customInstructions = '' } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'تصویر ارسال نشده است.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    if (!isValidBase64(cleanBase64)) {
      return res.status(400).json({ success: false, error: 'فرمت تصویر نامعتبر است.' });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const finalMimeType = allowedMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';

    const ai = getGeminiClient();

    const systemInstruction = `
شما یک مهندس ارشد کنترل کیفیت (QC Inspector) و متخصص تشخیص عیوب قطعات الکترونیکی، بردها (PCB)، چیپ‌ها و قطعات صنعتی هستید.
وظیفه اصلی شما تحلیل دقیق تصویر ارسال شده از قطعه و تشخیص موارد زیر است:
1. **سوختگی و آثار حرارتی (Burn Marks / Overheating)**: هرگونه سیاهی، تغییر رنگ دودی، ذوب‌شدگی خازن‌ها، مقاومت‌ها، ترانزیستورها یا ترک‌های حرارتی.
2. **قطعه پریدگی و نقص قطعات (Missing Components)**: پدهای خالی لحیم، جای خالی قطعات SMD، قطعات جداشده یا ناقص.
3. **ایراد ظاهری و بدنه (Cosmetic & Physical Damage)**: شکستگی، ترک، پایه کج یا شکسته شده IC، خراش شدید، زنگ‌زدگی، سولفاته شدن پدها.
4. **لحیم‌کاری معیوب (Solder Defects)**: اتصال کوتاه (سولدر بریج / پل لحیم)، لحیم سرد، پایه لحیم‌نشده.

تمام خروجی‌ها باید به زبان فارسی روان، تخصصی و کاملاً دقیق ارائه شوند.
برای هر ایراد یافته شده، مختصات Bounding Box را به صورت نرمال‌شده بین 0 تا 1000 قرار دهید: [ymin, xmin, ymax, xmax] که در آن 0 بالا/چپ و 1000 پایین/راست تصویر است.
دقت حساسیتی درخواستی کاربر: ${sensitivity}.

اگر قطعه کاملاً سالم است و هیچ سوختگی، قطعه‌پریدگی یا ایراد ظاهری ندارد، overallStatus را "PASSED"، defectDetected را false و qualityScore را بین 90 تا 100 قرار دهید.
اگر دارای عیوب بحرانی مانند سوختگی شدید یا قطعه‌پریدگی کلیدی است، overallStatus را "DEFECTIVE"، defectDetected را true و qualityScore را متناسب کاهش دهید.
`;

    const promptText = `
لطفاً این تصویر قطعه (نوع: ${componentType}) را با دقت میکروسکوپی بررسی کرده و نتایج بازرسی فنی را در قالب ساختار مشخص شده بازگردانید.
توضیحات تکمیلی کاربر: ${customInstructions || 'ندارد'}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: finalMimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        systemInstruction,
        temperature: 0.15,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            componentName: { type: Type.STRING, description: 'نام یا نوع قطعه شناسایی شده (مثلاً برد مدار چاپی تغذیه)' },
            componentType: { type: Type.STRING, description: 'دسته‌بندی اصلی قطعه' },
            overallStatus: { type: Type.STRING, description: 'PASSED یا DEFECTIVE یا WARNING' },
            defectDetected: { type: Type.BOOLEAN, description: 'آیا ایرادی یافت شد یا خیر' },
            qualityScore: { type: Type.NUMBER, description: 'امتیاز کیفیت قطعه از 0 تا 100' },
            qualityGrade: { type: Type.STRING, description: 'رتبه کیفیت: A, B, C, D, F' },
            summary: { type: Type.STRING, description: 'خلاصه جامع وضعیت قطعه به فارسی' },
            healthyAreas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'بخش‌های سالم و بدون ایراد قطعه'
            },
            detectedIssues: {
              type: Type.ARRAY,
              description: 'لیست عیوب شناسایی شده شامل سوختگی، قطعه پریدگی، شکستگی یا لحیم‌کاری',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'شناسه یکتا ایراد' },
                  title: { type: Type.STRING, description: 'عنوان ایراد (مثلاً اثر سوختگی روی خازن C1)' },
                  category: { type: Type.STRING, description: 'burn یا missing یا damage یا solder یا other' },
                  severity: { type: Type.STRING, description: 'high یا medium یا low' },
                  location: { type: Type.STRING, description: 'موقعیت دقیق ایراد روی قطعه' },
                  boundingBox: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    description: 'مختصات چهارگانه [ymin, xmin, ymax, xmax] بین 0 تا 1000'
                  },
                  description: { type: Type.STRING, description: 'توضیح کامل دلیلی و ظاهری عیب' },
                  recommendation: { type: Type.STRING, description: 'پیشنهاد تعمیر، تعویض یا بازکاری' }
                },
                required: ['title', 'category', 'severity', 'location', 'description', 'recommendation']
              }
            }
          },
          required: ['componentName', 'overallStatus', 'defectDetected', 'qualityScore', 'qualityGrade', 'summary', 'detectedIssues', 'healthyAreas']
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('پاسخی از مدل هوش مصنوعی دریافت نشد.');
    }

    const parsedData = JSON.parse(responseText);

    const inspectionResult = {
      id: `insp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      componentName: parsedData.componentName || 'قطعه صنعتی',
      componentType: parsedData.componentType || componentType,
      overallStatus: parsedData.overallStatus || (parsedData.defectDetected ? 'DEFECTIVE' : 'PASSED'),
      defectDetected: Boolean(parsedData.defectDetected),
      qualityScore: typeof parsedData.qualityScore === 'number' ? Math.round(parsedData.qualityScore) : (parsedData.defectDetected ? 45 : 98),
      qualityGrade: parsedData.qualityGrade || (parsedData.defectDetected ? 'D' : 'A'),
      summary: parsedData.summary || 'بازرسی کامل شد.',
      detectedIssues: (parsedData.detectedIssues || []).map((issue: any, index: number) => ({
        id: issue.id || `issue-${index + 1}`,
        title: issue.title || 'ایراد شناور',
        category: issue.category || 'other',
        severity: issue.severity || 'medium',
        location: issue.location || 'مشخص نشده',
        boundingBox: Array.isArray(issue.boundingBox) && issue.boundingBox.length === 4 ? issue.boundingBox : undefined,
        description: issue.description || '',
        recommendation: issue.recommendation || 'بررسی دقیق‌تر توسط تکنسین'
      })),
      healthyAreas: parsedData.healthyAreas || ['بخش‌های اصلی مدار'],
      imageUrl: '',
      inspectionTimeMs: 0
    };

    return res.json({ success: true, result: inspectionResult });

  } catch (error: any) {
    console.error('Inspection API Error:', error);

    // Better error messages for specific Gemini errors
    let errorMessage = 'خطا در فرایند آنالیز هوشمند تصویر قطعه.';
    if (error.message?.includes('API key')) {
      errorMessage = 'کلید API نامعتبر یا منقضی شده است.';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'سهمیه API تمام شده است. لطفاً بعداً تلاش کنید.';
    } else if (error.message?.includes('content')) {
      errorMessage = 'تصویر ارسالی نامعتبر یا خیلی بزرگ است.';
    } else if (error.status === 429) {
      errorMessage = 'تعداد درخواست به API بیش از حد مجاز است.';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on http://0.0.0.0:${PORT}`);
    console.log(`📱 Health check: http://0.0.0.0:${PORT}/api/health`);
  });
}

startServer();
