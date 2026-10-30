import ChangePasswordPage from "../auth/ChangePasswordPage";
import { useExpensesMe } from "../auth/ExpensesGuard";
import { useMobileTopbar } from "./MobileShell";

// Mesma troca de senha da versão completa, na moldura mobile. Na troca
// obrigatória (senha provisória) não há para onde voltar.
export default function MobileChangePasswordPage() {
  const forced = Boolean(useExpensesMe().data?.user.mustChangePassword);
  useMobileTopbar("Trocar senha", forced ? undefined : "/expenses/m/more");
  return <ChangePasswordPage embedded />;
}
