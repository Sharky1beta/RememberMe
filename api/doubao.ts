import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { base64Image } = req.body;
  if (!base64Image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  // 获取环境变量。为了兼容已有设置，同时读取带 VITE_ 前缀的变量
  const API_KEY = process.env.DOUBAO_API_KEY || process.env.VITE_DOUBAO_API_KEY;
  const MODEL_ID = process.env.DOUBAO_MODEL_ID || process.env.VITE_DOUBAO_MODEL_ID;

  if (!API_KEY || !MODEL_ID) {
    return res.status(500).json({ error: '后端环境配置缺失 (API Key or Model ID)' });
  }

  const prompt = `你是一个物品识别助手。请识别这张图片中的主要物品，并为其提供一个简洁的二级分类。
请严格以 JSON 格式返回，不要有任何 Markdown 标记或多余文字。
格式示例：{"name": "感冒灵", "category": "药品"}
物品名称要具体，分类要简洁（如：食品、电子产品、生活用品、药品、工具等）。`;

  const url = `https://ark.cn-beijing.volces.com/api/v3/chat/completions`;
  
  try {
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
      return res.status(response.status).json({ error: errData?.error?.message || `HTTP ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("豆包 API 调用失败:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
