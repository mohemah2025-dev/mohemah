import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { CustomerAuth } from "@/components/RegistrationForms";
import { AuthScreen } from "@/components/AuthScreen";

export const Route = createFileRoute("/auth")({ component: CustomerAuthPage });

function CustomerAuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && user) navigate({ to: "/" }); }, [user, loading, navigate]);
  return (
    <AuthScreen badge="تطبيق طالب الخدمة" title="مرحباً بك في مهمة" subtitle="سجّل دخولك أو أنشئ حساباً لطلب الخدمات" switchTo={{ to: "/provider/auth", label: "أنت مقدم خدمة؟ ادخل من تطبيق مقدم الخدمة" }}>
      <CustomerAuth onDone={() => navigate({ to: "/" })} />
    </AuthScreen>
  );
}
