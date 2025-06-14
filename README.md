# 🎓 CollegePedia

Your one-stop platform for discovering, comparing, and exploring colleges across India. Built with modern web technologies to deliver speed, clarity, and a student-first experience.

---

## 🖼️ Preview

![CollegePedia Hero](./images/hero.png)

---

## 🚀 Features

- 🔍 Search colleges by name, stream, or location
- 🗺️ Interactive maps and virtual campus tours
- 📊 Compare colleges by rankings, fees, placements
- 📰 Latest education news and exam updates
- 🧾 Admission predictor based on user input

<img src="./images/features.png" alt="Features Screenshot" width="700"/>

---

## 💻 Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (EJS Templates)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Deployment**: Vercel / Heroku / VPS 

---

## 📂 Project Structure

collegepedia/
│
├── Config/
├── public/ # Static files (CSS, JS, images)
├── views/ # EJS templates
├── routes/ # Express routes
├── controllers/ # Logic and handlers
├── models/ # Mongoose models
├── .env
├── app.js
└── README.md


---

## 📸 More Screenshots

### 🔎 Search Page
<img src="./images/search-page.png" alt="Search Page" width="600"/>

### 🧮 College Comparison
<img src="./images/comparison.png" alt="College Comparison" width="600"/>

---

## 🧪 Setup Locally

```bash
git clone https://github.com/Tejas-Bansod/CollegePedia.git
cd CollegePedia
npm install
cp .env  # Add your MongoDB URI and other config
npm run dev

