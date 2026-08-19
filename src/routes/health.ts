import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        const { error } = await supabase
          .from("attendance_punches")
          .select("id")
          .limit(1);

        if (error) {
          return new Response(
            JSON.stringify({
              status: "unhealthy",
              database: "disconnected",
              error: error.message,
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }

        return new Response(
          JSON.stringify({
            status: "healthy",
            database: "connected",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      },
    },
  },
});