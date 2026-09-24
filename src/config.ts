export const CONFIG = {
  // Đổi thành false khi muốn dùng Google Gemini API
  USE_LOCAL_AI: true, 

  // Địa chỉ IP máy tính của bạn (Thay 192.168.1.x bằng IP Wi-Fi PC của bạn)
  // Đừng dùng 'localhost' nếu bạn test app trên điện thoại thật!
  OLLAMA_BASE_URL: 'http://10.0.2.2:11434/api/generate',
  OLLAMA_MODEL: 'llama3.2',

  // Google AI Gemini Config
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: 'gemini-1.5-flash',
};