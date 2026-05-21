/**
 * Tests for documents201Storage upload method.
 * Validates file upload to Supabase Storage bucket "employee-documents".
 */

const mockUpload = jest.fn();

jest.mock("@/services/supabase-browser", () => ({
  createClient: () => ({
    from: jest.fn(),
    storage: {
      from: () => ({
        upload: mockUpload,
      }),
    },
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  }),
}));

import { documents201Storage } from "@/services/db.service";

describe("documents201Storage.upload", () => {
  const employeeId = "EMP-001";
  const documentType = "employment_contract";
  const mockFile = new File(["test content"], "contract.pdf", { type: "application/pdf" });

  beforeEach(() => {
    mockUpload.mockReset();
  });

  it("uploads file to correct path and returns path on success", async () => {
    mockUpload.mockResolvedValue({ data: { path: `${employeeId}/${documentType}/${mockFile.name}` }, error: null });

    const result = await documents201Storage.upload(employeeId, documentType, mockFile);

    expect(mockUpload).toHaveBeenCalledWith(
      `${employeeId}/${documentType}/${mockFile.name}`,
      mockFile
    );
    expect(result).toEqual({ path: `${employeeId}/${documentType}/${mockFile.name}` });
  });

  it("returns path: '' and error message on upload failure", async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: "Bucket not found" } });

    const result = await documents201Storage.upload(employeeId, documentType, mockFile);

    expect(result).toEqual({ path: "", error: "Bucket not found" });
  });

  it("constructs path as employeeId/documentType/filename", async () => {
    const file = new File(["data"], "my-doc.png", { type: "image/png" });
    mockUpload.mockResolvedValue({ data: { path: "EMP-002/medical/my-doc.png" }, error: null });

    const result = await documents201Storage.upload("EMP-002", "medical", file);

    expect(mockUpload).toHaveBeenCalledWith("EMP-002/medical/my-doc.png", file);
    expect(result.path).toBe("EMP-002/medical/my-doc.png");
    expect(result.error).toBeUndefined();
  });
});
