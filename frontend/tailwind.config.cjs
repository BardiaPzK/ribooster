module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4f46e5",
          dark: "#4338ca"
        }
      },
      boxShadow: {
        soft: "0 20px 40px rgba(15,23,42,0.25)"
      }
    }
  },
  plugins: []
};
