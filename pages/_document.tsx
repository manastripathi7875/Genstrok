import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Required for PWA */}
        <meta name="theme-color" content="#020617" />
        <meta name="application-name" content="Genstrok" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Genstrok" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}