// 不再使用官方 SDK，改用走本地 Vite 代理的 Fetch 请求
const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY || "";
const MODEL_ID = import.meta.env.VITE_DOUBAO_MODEL_ID || "";

export interface AiResult {
  name: string;
  category: string;
}

export async function identifyImage(base64Image: string): Promise<AiResult> {
  if (!API_KEY || !MODEL_ID) {
    throw new Error("请先在 .env 文件中配置 VITE_DOUBAO_API_KEY 和 VITE_DOUBAO_MODEL_ID");
  }

  try {
    const prompt = `你是一个物品识别助手。请识别这张图片中的主要物品，并为其提供一个简洁的二级分类。
请严格以 JSON 格式返回，不要有任何 Markdown 标记或多余文字。
格式示例：{"name": "感冒灵", "category": "药品"}
物品名称要具体，分类要简洁（如：食品、电子产品、生活用品、药品、工具等）。`;

    const url = `/doubao-api/api/v3/chat/completions`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: base64Image }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    
    if (text) {
      try {
        return JSON.parse(text) as AiResult;
      } catch (e) {
        // 如果解析失败，尝试从字符串中提取
        const match = text.match(/\{.*?\}/s);
        if (match) return JSON.parse(match[0]) as AiResult;
        throw new Error("解析 AI 返回结果失败");
      }
    }
    throw new Error("模型未返回识别结果");
  } catch (error: any) {
    console.error("豆包识别失败:", error);
    throw error;
  }
}
