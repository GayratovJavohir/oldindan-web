import LoginFeature from '../features/auth/login/Login';
import { Navigate } from 'react-router-dom';
import { getDefaultRouteForRole, getStoredUser } from '../utils/authUser';

function hasAuthToken() {
    return Boolean(localStorage.getItem('rp_access') || localStorage.getItem('token'));
}

export default function LoginPage() {
    if (hasAuthToken()) {
        const user = getStoredUser();
        return <Navigate to={getDefaultRouteForRole(user?.role || 'manager')} replace />;
    }

    return (
        <div className="page-wrapper">
            <LoginFeature />
        </div>
    );
}
