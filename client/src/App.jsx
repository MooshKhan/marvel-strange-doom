import { BrowserRouter, Link, Route, Routes } from "react-router";
import CharacterGallery from "./CharacterGallery.jsx";
import CharacterDetail from "./CharacterDetail.jsx";
import { AccountBar, AccountPage, AuthProvider } from "./Auth.jsx";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <AccountBar />
      <Routes>
        <Route path="/account" element={<AccountPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
