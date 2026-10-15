import type { App, Component } from "vue";

export type OfficePreviewFormat = "docx" | "xlsx" | "pptx";

export async function mountOfficePreview(
  container: HTMLElement,
  format: OfficePreviewFormat,
  source: ArrayBuffer,
  onRendered: () => void,
  onError: () => void,
) {
  const [{ createApp, h }, componentModule] = await Promise.all([
    import("vue"),
    format === "docx"
      ? import("@vue-office/docx")
      : format === "xlsx"
        ? import("@vue-office/excel")
        : import("@vue-office/pptx"),
  ]);
  if (format === "docx") await import("@vue-office/docx/lib/index.css");
  if (format === "xlsx") await import("@vue-office/excel/lib/index.css");

  const component = componentModule.default as Component;
  const app: App = createApp({
    render: () =>
      h(component, {
        src: source,
        style: { minHeight: "60vh", width: "100%" },
        onRendered,
        onError,
      }),
  });
  app.mount(container);
  return () => app.unmount();
}
