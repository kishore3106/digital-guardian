import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { URLSafetyReport, ImageAnalysisReport, VideoAnalysisReport, ChatMessage, PdfAnalysisReport } from '../types';
import { SafetyLevel } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const urlResponseSchema = {
  type: Type.OBJECT,
  properties: {
    safetyLevel: { type: Type.STRING, enum: Object.values(SafetyLevel) },
    summary: { type: Type.STRING },
    threats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["type", "description"]
      }
    },
    trustScore: { type: Type.INTEGER, description: "A score from 0 (very untrustworthy) to 100 (very trustworthy)." },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A bulleted list of 3-4 key findings."}
  },
  required: ["safetyLevel", "summary", "threats", "trustScore", "keyPoints"]
};

const imageResponseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A brief summary of the findings." },
        deepfakeConfidence: { type: Type.NUMBER, description: "A confidence score (0-100) on whether the image is a deepfake." },
        aiGeneratedConfidence: { type: Type.NUMBER, description: "A confidence score (0-100) on whether the image is AI-generated." },
        manipulationSigns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of observed manipulation signs (e.g., 'Unnatural lighting', 'Distorted background')."},
        trustScore: { type: Type.INTEGER, description: "A score from 0 (likely manipulated) to 100 (likely authentic)." },
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A bulleted list of 3-4 key findings about the image's authenticity."},
        visualCues: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "A brief text description of what is suspicious about this area." },
                    area: {
                        type: Type.ARRAY,
                        items: { type: Type.NUMBER },
                        description: "A bounding box for the suspicious area, represented as [topLeftX, topLeftY, width, height]. All values are percentages (0-100) relative to the image dimensions."
                    }
                },
                required: ["description", "area"]
            },
            description: "A list of specific areas on the image that show signs of manipulation. Return an empty array if none are found."
        }
    },
    required: ["summary", "deepfakeConfidence", "aiGeneratedConfidence", "manipulationSigns", "trustScore", "keyPoints", "visualCues"]
};

const videoResponseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A brief summary of the video analysis findings." },
        deepfakeConfidence: { type: Type.NUMBER, description: "A confidence score (0-100) on whether the video content is a deepfake." },
        manipulationSigns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of observed visual manipulation signs (e.g., 'Unnatural facial movements', 'Blurry artifacts around edges')."},
        trustScore: { type: Type.INTEGER, description: "An overall score from 0 (likely manipulated) to 100 (likely authentic)." },
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A bulleted list of 3-4 key findings about the video's authenticity."},
        audioAnalysisSummary: { type: Type.STRING, description: "A summary of the audio track analysis, noting any signs of tampering, mismatched lip sync, or synthetic speech. Since you can't hear audio, base this on visual cues like lip sync." },
        temporalInconsistencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of inconsistencies observed over time in the video (e.g., 'Objects disappearing', 'Inconsistent lighting changes between frames')."},
        visualCues: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "A brief text description of what is suspicious about this area." },
                    timestamp: { type: Type.NUMBER, description: "The approximate timestamp in seconds where the suspicious event occurs, inferred from the frame sequence." },
                    area: {
                        type: Type.ARRAY,
                        items: { type: Type.NUMBER },
                        description: "A bounding box for the suspicious area, represented as [topLeftX, topLeftY, width, height]. All values are percentages (0-100) relative to the video frame dimensions."
                    }
                },
                required: ["description", "timestamp", "area"]
            },
            description: "A list of specific areas in the video that show signs of manipulation. Return an empty array if none are found."
        }
    },
    required: ["summary", "deepfakeConfidence", "manipulationSigns", "trustScore", "keyPoints", "audioAnalysisSummary", "temporalInconsistencies", "visualCues"]
};

const pdfCombinedResponseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A brief summary of the PDF analysis findings, starting with a clear conclusion." },
        trustScore: { type: Type.INTEGER, description: "An overall score from 0 (likely malicious) to 100 (likely safe)." },
        detectedLinks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    url: { type: Type.STRING },
                    risk: { type: Type.STRING, enum: ['High', 'Medium', 'Low', 'Unknown'] }
                },
                required: ["url", "risk"]
            },
            description: "A list of all URLs found in the PDF and their assessed risk level."
        },
        malwareIndicators: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of observed signs of potential malware (e.g., 'Obfuscated scripts')."},
        socialEngineeringTactics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of observed psychological manipulation tactics (e.g., 'Urgent language', 'Impersonation')." },
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A bulleted list of 3-4 key findings about the PDF's safety."},
        visualCues: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "A brief text description of what is suspicious about this visual element." },
                    page: { type: Type.INTEGER, description: "The page number where the suspicious element appears." },
                    area: {
                        type: Type.ARRAY,
                        items: { type: Type.NUMBER },
                        description: "A bounding box for the suspicious area, represented as [topLeftX, topLeftY, width, height]. All values are percentages (0-100) relative to the page dimensions."
                    }
                },
                required: ["description", "page", "area"]
            },
            description: "A list of specific visual elements in the PDF that appear suspicious. Return an empty array if none are found."
        }
    },
    required: ["summary", "trustScore", "detectedLinks", "malwareIndicators", "socialEngineeringTactics", "keyPoints", "visualCues"]
};


export async function analyzeUrl(url: string, language: string): Promise<URLSafetyReport> {
  const prompt = `Act as a senior cybersecurity analyst. Analyze the URL: ${url}. Check for phishing, malware, domain reputation, SSL, and other risks. Provide a JSON response based on the schema. The summary should be particularly clear and educational for a non-technical user, avoiding jargon and explaining the 'why' behind the safety assessment. The keyPoints should be actionable advice or critical warnings. IMPORTANT: Only populate the 'threats' array if you identify a specific, credible threat. If the URL is safe regarding a certain category (e.g., phishing), do not add an entry to the 'threats' array for it. The 'threats' array must be empty if no threats are found. Your entire response MUST be in this language: ${language}.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        responseMimeType: "application/json", 
        responseSchema: urlResponseSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    const parsedData = JSON.parse(response.text.trim()) as URLSafetyReport;
    if (!parsedData.safetyLevel || !parsedData.summary) throw new Error("Invalid AI response structure.");
    return parsedData;
  } catch (error) {
    console.error("Error analyzing URL with Gemini:", error);
    throw new Error("Failed to get a valid analysis from the AI service.");
  }
}

export async function analyzeImage(
    imageDataBase64: string, 
    mimeType: string, 
    language: string,
    onProgress: (message: string) => void = () => {}
): Promise<ImageAnalysisReport> {
    onProgress('Analyzing image...');
    const prompt = `Act as a world-class digital image forensics expert with unparalleled accuracy. Your task is a critical analysis of the provided image for any signs of digital manipulation, AI generation, or deepfakes. Your reputation for extreme accuracy depends on this.

Perform a multi-layered analysis:
1.  **Lighting and Shadow Consistency:** Analyze the direction, harshness, and color of light sources. Ensure all shadows cast by objects are consistent with these sources. Look for mismatched highlights or shadows.
2.  **Reflection Integrity:** Examine reflections in shiny surfaces (eyes, glass, metal). Do they accurately depict the surrounding environment?
3.  **Physical Inconsistencies:** Scrutinize for anatomical impossibilities (e.g., malformed hands, extra fingers), impossible geometry, or objects that defy physics.
4.  **Digital Artifacts:** Look for subtle clues like compression differences between parts of the image, unusual noise patterns, sharp edges where there should be blur (or vice-versa), and signs of cloning or healing brush usage.
5.  **AI Generation Telltales:** Check for common AI artifacts like overly smooth skin textures, strange patterns in backgrounds, and nonsensical details.

For EVERY single anomaly you detect, no matter how small, you MUST provide a surgically precise bounding box in the 'visualCues' array. The description must be technical yet clear.

Provide a final JSON response based on the schema. The summary must be a definitive conclusion on the image's authenticity, and the trust score must directly reflect your deep analysis. Your entire response MUST be in this language: ${language}.`;
    const imagePart = { inlineData: { data: imageDataBase64, mimeType } };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
            config: { 
                responseMimeType: "application/json", 
                responseSchema: imageResponseSchema,
            }
        });
        const parsedData = JSON.parse(response.text.trim()) as ImageAnalysisReport;
        if (parsedData.deepfakeConfidence == null || parsedData.visualCues == null) {
            throw new Error("Invalid AI response structure for image analysis.");
        }
        onProgress('Analysis complete.');
        return parsedData;
    } catch (error) {
        console.error("Error analyzing image with Gemini:", error);
        throw new Error("Failed to get a valid image analysis from the AI service.");
    }
}

export async function analyzeVideo(
    videoFrames: string[],
    videoDuration: number,
    onProgress: (message: string) => void,
    language: string
): Promise<VideoAnalysisReport> {
    onProgress(`Analyzing ${videoFrames.length} video frames... This may take a moment.`);
    const prompt = `Act as a senior digital video forensics expert. You have been provided with a sequence of ${videoFrames.length} frames sampled evenly from a video with a total duration of ${videoDuration.toFixed(1)} seconds. Your task is to analyze these frames for any signs of deepfakes, manipulation, or synthetic generation.
- **Visual Analysis:** Look for unnatural facial movements, inconsistent blinking, awkward expressions, edge artifacts, blurring, and inconsistent lighting across frames.
- **Temporal Analysis:** Critically compare the frames to each other. Look for inconsistencies that emerge over time, such as objects appearing/disappearing, backgrounds warping, or lighting that changes unnaturally between frames.
- **Enhanced Summary:** Provide a highly detailed and insightful summary that connects all your findings. Explain the potential impact of any detected manipulation in simple terms for a non-technical user.
- **Audio Analysis (Inferred):** You cannot hear audio, but you can infer issues. Note any poor lip sync across the frames.
- **Visual Cues & Timestamp Accuracy:** For each identified visual anomaly, you MUST provide a 'visualCues' entry. This must include a description and a bounding box area. Crucially, you must provide an accurate timestamp. Calculate it precisely using this formula: timestamp = (frame_index / ${videoFrames.length}) * ${videoDuration.toFixed(1)}. The 'frame_index' is the zero-based index of the frame in the sequence where the anomaly is first clearly visible. The timestamp must be a number in seconds.
- **Bounding Box Precision:** The bounding box MUST be as tight as possible around the visual anomaly. This box will be used to draw a highlighting ellipse, so its accuracy is critical for the user experience.
Provide a single, consolidated JSON response based on the schema. Be thorough and objective. Your entire JSON response, including all summaries and descriptions, MUST be in this language: ${language}.`;
    
    const imageParts = videoFrames.map(frameData => ({
        inlineData: {
            data: frameData,
            mimeType: 'image/jpeg'
        }
    }));
    const contentParts = [...imageParts, { text: prompt }];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: contentParts },
            config: { 
                responseMimeType: "application/json", 
                responseSchema: videoResponseSchema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const parsedData = JSON.parse(response.text.trim()) as VideoAnalysisReport;
        if (parsedData.deepfakeConfidence == null || !parsedData.summary) {
            throw new Error("Invalid AI response structure for video analysis.");
        }
        onProgress('Analysis complete.');
        return parsedData;
    } catch (error) {
        console.error("Error analyzing video with Gemini:", error);
        throw new Error("Failed to get a valid video analysis from the AI service.");
    }
}

export async function analyzePdf(
    pdfDataBase64: string,
    language: string,
    onProgress: (message: string) => void
): Promise<PdfAnalysisReport> {
    onProgress('Analyzing PDF document...');

    const prompt = `Act as a Lead Digital Forensics Analyst. You must perform a comprehensive security analysis of the provided PDF document. Your analysis must cover three key areas:
1.  **Malware and Link Analysis:** Extract ALL hyperlinks, assess their risk level (High, Medium, Low, Unknown), and identify any indicators of malware like obfuscated scripts. Populate \`detectedLinks\` and \`malwareIndicators\`.
2.  **Social Engineering:** Analyze the text for psychological manipulation tactics like urgent language, impersonation, or deceptive calls-to-action. Populate \`socialEngineeringTactics\`.
3.  **Document Forgery:** Scrutinize the visual integrity. Look for pixelated logos, inconsistent fonts, misalignments, or forged signatures. For EVERY visual flaw, provide a surgically precise bounding box in the \`visualCues\` array.
Finally, synthesize all findings into a single, conclusive JSON report. The summary must be clear for a non-technical user, and the trust score must reflect the most severe threat found.
Your entire response MUST be a single JSON object that strictly adheres to the provided schema and MUST be in this language: ${language}.`;

    const pdfPart = { inlineData: { data: pdfDataBase64, mimeType: 'application/pdf' } };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [pdfPart, { text: prompt }] },
            config: { 
                responseMimeType: "application/json", 
                responseSchema: pdfCombinedResponseSchema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const finalReport = JSON.parse(response.text.trim()) as PdfAnalysisReport;
        onProgress('Analysis complete.');
        return finalReport;

    } catch (error) {
        console.error("Error during PDF analysis:", error);
        throw new Error("Failed to get a valid PDF analysis from the AI service.");
    }
}

export function startChat(language: string, mode: 'Detailed' | 'Concise'): Chat {
    const modeInstruction = mode === 'Detailed'
        ? "Your responses should be comprehensive, in-depth, and educational. Use headings, lists, and bold text to structure the information clearly. Assume the user wants to learn."
        : "Your responses should be concise, to-the-point, and summarized. Get straight to the answer without extra detail unless absolutely necessary.";

    const chatSession = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are 'Digital Guardian', an elite AI Cybersecurity Analyst. Your primary function is to provide expert-level analysis, advice, and education on all matters of digital security to a non-technical audience.
- **Response Style:** ${modeInstruction}
- **Expert Analysis:** When a user provides text, images, videos, PDFs, or a combination, analyze them thoroughly. Explain complex topics like phishing, malware, deepfakes, and scams in simple, clear terms. If media files are provided, analyze them for signs of manipulation or malicious intent and incorporate your findings into your response.
- **Mandatory Search & Sourcing:** You MUST ALWAYS use your search tool to find current, verifiable information. Your goal is to provide between 4 and 8 high-quality sources for every answer. Your sources should be a diverse mix of reputable websites and relevant YouTube videos.
- **Formatting and Citation Rules:**
    1.  Your main response MUST be well-formatted using markdown, including headings (e.g., '### Heading'), bold text, and lists for readability.
    2.  You MUST NOT include any URLs or links directly in your main response body.
    3.  All sources MUST be provided exclusively through the tool's grounding capabilities. The user's interface will automatically display a "Sources" section with clickable links based on this data.
    4.  Therefore, you MUST NOT write "Sources:", "References:", or any similar heading followed by a list of your sources in your main text response.
- **Language and Region:** The user is speaking ${language}. Your entire response, including summaries and explanations, MUST be in this language. Prioritize search results and sources that are also in ${language} or from that geographical region if possible.
- **Important:** You cannot return or edit images/videos/PDFs. Your entire response must be text-based, including your media analysis.`,
            tools: [{googleSearch: {}}],
            thinkingConfig: { thinkingBudget: 0 },
        },
    });
    return chatSession;
}
