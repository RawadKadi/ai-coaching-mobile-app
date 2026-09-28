import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
      </head>
      <body>
        <a href="https://www.sideprojectors.com/project/96231/ai-coaching-mobile-app" alt="ai-coaching-mobile-app is for sale at @SideProjectors">
          <img style={{ position: 'fixed', zIndex: 1000, top: -5, right: 20, border: 0 }} src="https://www.sideprojectors.com/img/badges/badge_2_red.png" alt="ai-coaching-mobile-app is sale at @SideProjectors" />
        </a>
        {children}
      </body>
    </html>
  );
}
