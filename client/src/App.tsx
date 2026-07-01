import { Navigate, Route, Routes } from "react-router-dom";
import { SignUpForm } from "@/features/auth";

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Routes>
        <Route path="/" element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-in" element={<div>Sign in — coming next</div>} />
        <Route path="/sign-up" element={<SignUpForm />} />
      </Routes>
    </div>
  );
}
