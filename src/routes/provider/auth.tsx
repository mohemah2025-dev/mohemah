import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { ProviderAuth } from "@/components/RegistrationForms";
import { AuthScreen } from "@/components/AuthScreen";

export const Route = createFileRoute("/provider/auth")({ component: ProviderAuthPage });

function ProviderAuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && user) navigate({ to: "/provider" }); }, [user, loading, navigate]);
  return (
    <AuthScreen badge="تطبيق مقدم الخدمة" title="مهمة للشركاء" subtitle="سجّل دخولك أو قدّم طلب انضمامك كمقدم خدمة" switchTo={{ to: "/auth", label: "تبحث عن خدمة؟ ادخل من تطبيق طالب الخدمة" }}>
      <ProviderAuth onDone={() => navigate({ to: "/provider" })} />
    </AuthScreen>
  );
}
