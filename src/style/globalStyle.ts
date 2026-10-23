import { css } from "@emotion/react";
export const GlobalStyles = css`
  @font-face {
    font-family: Pretendard;
    src: url('/Font/PretendardVariable.woff2') format('woff2');
    font-weight: 100 900;
    font-display: swap;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; width: 100%; }
`;
