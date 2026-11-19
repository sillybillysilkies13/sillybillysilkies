import { Navigate } from "react-router-dom";
import { isAdminLoggedIn } from "../utils/backend";

const ProtectedRoute = ({ children }) => {
    // Requires a valid, unexpired login token from /login.
    return isAdminLoggedIn() ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
