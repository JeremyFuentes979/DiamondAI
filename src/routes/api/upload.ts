import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleUpload } from "~/lib/upload-handler";

export const APIRoute = createAPIFileRoute("/api/upload")({
  POST: async ({ request }) => {
    return handleUpload(request);
  },
});
