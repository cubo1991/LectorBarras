export function Card({ className = "", ...props }: React.ComponentProps<"div">) {
  return <div className={`rounded-control border border-border bg-surface p-4 ${className}`} {...props} />;
}
