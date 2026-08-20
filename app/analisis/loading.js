import AppShell from "@/components/AppShell";

export default function AnalisisLoading() {
  return (
    <AppShell currentMonth="">
      <div className="analisis-page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: "6rem", height: "1.15rem", marginBottom: "0.5rem" }} />
          <div className="skeleton skeleton-text" style={{ width: "18rem", height: "0.8rem" }} />
        </div>
      </div>
      <div className="analisis-workspace">
        <div className="skeleton" style={{ height: "2rem", width: "12rem", marginBottom: "1rem" }} />
        <div className="skeleton" style={{ height: "5rem", marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ height: "280px", marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ height: "240px", marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ height: "10rem" }} />
      </div>
    </AppShell>
  );
}
