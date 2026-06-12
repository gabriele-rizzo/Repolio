// TEMP debug route — safe to delete. Renders the connection toast with no auth gate.
import { ConnectionStatusToast } from "@/components/account/connection-status-toast";

export default function ToastTest() {
    return (
        <div style={{ padding: 40 }}>
            <h1 data-testid="marker">toast test page</h1>
            <ConnectionStatusToast connected />
        </div>
    );
}
