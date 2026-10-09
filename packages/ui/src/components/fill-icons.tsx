import type { ComponentProps, ReactNode } from "react";

/**
 * Figma: the filled icons of the Barra de abas (page "Ícones": Ícone/layout-grid-fill 313:173,
 * calendar-fill 80:33, wallet-fill 313:182), exported from Figma at 24 with the fill on
 * currentColor, so the tab gives the color (icon/current). Lucide has no filled versions.
 */
type FillIconProps = Omit<ComponentProps<"svg">, "children">;

function FillIcon({ children, ...props }: FillIconProps & { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

function LayoutGridFill(props: FillIconProps) {
  return (
    <FillIcon {...props}>
      <path d="M8.5 2.5H4.5C3.39543 2.5 2.5 3.39543 2.5 4.5V8.5C2.5 9.60457 3.39543 10.5 4.5 10.5H8.5C9.60457 10.5 10.5 9.60457 10.5 8.5V4.5C10.5 3.39543 9.60457 2.5 8.5 2.5Z" />
      <path d="M19.5 2.5H15.5C14.3954 2.5 13.5 3.39543 13.5 4.5V8.5C13.5 9.60457 14.3954 10.5 15.5 10.5H19.5C20.6046 10.5 21.5 9.60457 21.5 8.5V4.5C21.5 3.39543 20.6046 2.5 19.5 2.5Z" />
      <path d="M19.5 13.5H15.5C14.3954 13.5 13.5 14.3954 13.5 15.5V19.5C13.5 20.6046 14.3954 21.5 15.5 21.5H19.5C20.6046 21.5 21.5 20.6046 21.5 19.5V15.5C21.5 14.3954 20.6046 13.5 19.5 13.5Z" />
      <path d="M8.5 13.5H4.5C3.39543 13.5 2.5 14.3954 2.5 15.5V19.5C2.5 20.6046 3.39543 21.5 4.5 21.5H8.5C9.60457 21.5 10.5 20.6046 10.5 19.5V15.5C10.5 14.3954 9.60457 13.5 8.5 13.5Z" />
    </FillIcon>
  );
}

function CalendarFill(props: FillIconProps) {
  return (
    <FillIcon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3ZM3 8.4H21V9.8H3V8.4Z"
      />
      <path d="M8.75 2.25C8.75 1.83579 8.41421 1.5 8 1.5C7.58579 1.5 7.25 1.83579 7.25 2.25V4.95C7.25 5.36421 7.58579 5.7 8 5.7C8.41421 5.7 8.75 5.36421 8.75 4.95V2.25Z" />
      <path d="M16.75 2.25C16.75 1.83579 16.4142 1.5 16 1.5C15.5858 1.5 15.25 1.83579 15.25 2.25V4.95C15.25 5.36421 15.5858 5.7 16 5.7C16.4142 5.7 16.75 5.36421 16.75 4.95V2.25Z" />
    </FillIcon>
  );
}

function WalletFill(props: FillIconProps) {
  return (
    <FillIcon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 4H17C17.2652 4 17.5196 4.10536 17.7071 4.29289C17.8946 4.48043 18 4.73478 18 5V7H5.5C5.23478 7 4.98043 7.10536 4.79289 7.29289C4.60536 7.48043 4.5 7.73478 4.5 8C4.5 8.26522 4.60536 8.51957 4.79289 8.70711C4.98043 8.89464 5.23478 9 5.5 9H19C19.7956 9 20.5587 9.31607 21.1213 9.87868C21.6839 10.4413 22 11.2044 22 12V18C22 18.7956 21.6839 19.5587 21.1213 20.1213C20.5587 20.6839 19.7956 21 19 21H5C4.20435 21 3.44129 20.6839 2.87868 20.1213C2.31607 19.5587 2 18.7956 2 18V7C2 6.20435 2.31607 5.44129 2.87868 4.87868C3.44129 4.31607 4.20435 4 5 4ZM17 17C17.3978 17 17.7794 16.842 18.0607 16.5607C18.342 16.2794 18.5 15.8978 18.5 15.5C18.5 15.1022 18.342 14.7206 18.0607 14.4393C17.7794 14.158 17.3978 14 17 14C16.6022 14 16.2206 14.158 15.9393 14.4393C15.658 14.7206 15.5 15.1022 15.5 15.5C15.5 15.8978 15.658 16.2794 15.9393 16.5607C16.2206 16.842 16.6022 17 17 17Z"
      />
    </FillIcon>
  );
}

export { CalendarFill, type FillIconProps, LayoutGridFill, WalletFill };
