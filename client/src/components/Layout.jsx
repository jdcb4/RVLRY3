import { Link } from 'react-router-dom';

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <header>
        <Link to="/" className="logo">
          RVLRY
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
