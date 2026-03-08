import "./globals.css";

export const metadata = {
    title: "Revenue Operations Console",
    description: "Next.js Admin Dashboard",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
