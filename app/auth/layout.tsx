export default async function AuthLayout({ children }: LayoutProps<"/admin">) {
    return <div className="size-full min-h-dvh items-center justify-center flex">{children}</div>;
}
