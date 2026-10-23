import { Global } from "@emotion/react";
import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { GlobalStyles } from "./style/globalStyle";
import Router from "./routes";
import { useAuthStore } from "./store/storeIndex";
import LoginPanel from "./Components/Feature/LoginSystem/LoginPanel";
import Toast from "./Components/UI/Toast";

function App() {
  const { initialized, isAuthenticated, checkAuthStatus } = useAuthStore();
  useEffect(() => { void checkAuthStatus(); }, [checkAuthStatus]);
  return (
    <>
      <Global styles={GlobalStyles} />
      <BrowserRouter>
        {!initialized ? <div className="initial-loading" role="status">로그인 상태를 확인하고 있습니다…</div>
          : isAuthenticated ? <Router /> : <LoginPanel />}
      </BrowserRouter>
      <Toast />
    </>
  );
}
export default App;
