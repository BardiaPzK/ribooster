import { useContext } from "react";
import { AuthCtx } from "../providers/AuthProvider";
export const useAuth = () => useContext(AuthCtx);
