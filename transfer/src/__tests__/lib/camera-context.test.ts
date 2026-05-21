import { canUseCamera, cameraHttpsHint, isLoopbackHostname } from "@/lib/camera-context";

describe("camera-context", () => {
    it("recognizes loopback hostnames", () => {
        expect(isLoopbackHostname("localhost")).toBe(true);
        expect(isLoopbackHostname("127.0.0.1")).toBe(true);
        expect(isLoopbackHostname("::1")).toBe(true);
        expect(isLoopbackHostname("dev.localhost")).toBe(true);
        expect(isLoopbackHostname("example.com")).toBe(false);
    });

    it("allows camera on secure contexts and loopback hosts", () => {
        expect(canUseCamera({ isSecureContext: true, location: { hostname: "example.com" } as Location })).toBe(true);
        expect(canUseCamera({ isSecureContext: false, location: { hostname: "localhost" } as Location })).toBe(true);
        expect(canUseCamera({ isSecureContext: false, location: { hostname: "example.com" } as Location })).toBe(false);
    });

    it("returns a useful HTTPS hint", () => {
        expect(cameraHttpsHint("/kiosk/qr")).toContain("npm run dev:https");
        expect(cameraHttpsHint("/kiosk/qr")).toContain("/kiosk/qr");
    });
});
