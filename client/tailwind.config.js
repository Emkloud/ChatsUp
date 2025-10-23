/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#25D366',
          lightgreen: '#D1F2EB',
          lgreen: '#DCF8C6',
          dgreen: '#128C7E',
          gray: '#ECE5DD',
          dgray: '#111B21',
          lightgray: '#F0F2F5',
        }
      },
      fontFamily: {
        whatsapp: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}