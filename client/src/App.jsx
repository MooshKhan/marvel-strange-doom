import { BrowserRouter, Link, Route, Routes } from "react-router";
import CharacterGallery from "./CharacterGallery.jsx";
import CharacterDetail from "./CharacterDetail.jsx";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CharacterGallery />} />

        <Route
          path="/characters/:slug"
          element={<CharacterDetail />}
        />

        <Route
          path="*"
          element={
            <main className="explorer">
              <h1>Page not found</h1>
              <Link to="/">Back to gallery</Link>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;