import './globals.css';
export const metadata = { title: 'AuraGen' };
export default function Layout({ children }) {
  return <html lang="en"><body className="bg-slate-50 text-slate-900">{children}</body></html>;
}
