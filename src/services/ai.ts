// 前端不再需要直接读取和暴露 API Key，这部分由后端安全处理
export interface AiResult {
  name: string;
  category: string;
}

export async function identifyImage(base64Image: string): Promise<AiResult> {
  try {
    const url = `/api/doubao`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ base64Image })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error || `后端返回了 HTTP ${response.status}`);
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


/**
 * 彻底跳转到 Google 识图
 */
export function jumpToGoogleLens(_base64Image: string) {
  // 由于 Web 端直接 POST 图片到谷歌 Lens 接口受限（CSRF），
  // 最稳妥且符合用户预期的做法是引导跳转到 Lens 上传页。
  // 用户在手机端只需点击“相机”图标，由于刚拍过照，系统通常会提示选取最后一张照片。
  window.open(`https://lens.google.com/search?p=1`, '_blank');
  
  // 增加友好提示
  setTimeout(() => {
    alert('已为你跳转到 Google Lens。\n\n请点击页面上的“相机图标”并选择刚才拍摄的照片即可获得最精准的识别结果（含 AI 概览）。');
  }, 500);
}
