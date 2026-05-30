/* NUMU "Souq" iconography — Phosphor icons rendered as LIGHT-DOM inline SVG
   via the Iconify JS API. Light-DOM SVG is robust everywhere: live render,
   html-to-image screenshots, and offline bundling (no shadow DOM, no icon font).
   Phosphor styles map to weight: bold (default), fill, duotone, regular. */
const { useState: useIcoState, useEffect: useIcoEffect } = React;

function Icon({ name, weight = "bold", size, className = "", style = {} }) {
  const suffix = weight && weight !== "regular" ? `-${weight}` : "";
  const full = `ph:${name}${suffix}`;
  const [, force] = useIcoState(0);
  const ico = window.Iconify && Iconify.getIcon ? Iconify.getIcon(full) : null;

  useIcoEffect(() => {
    if (window.Iconify && !Iconify.iconExists(full)) {
      Iconify.loadIcons([full], () => force(x => x + 1));
    }
  }, [full]);

  const dim = size ? size + "px" : "1em";
  if (!ico) {
    // reserve space until the icon resolves
    return <span className={"numu-ico " + className} style={{ width: dim, height: dim, display: "inline-block", ...style }} aria-hidden="true" />;
  }
  return (
    <svg
      className={"numu-ico " + className} xmlns="http://www.w3.org/2000/svg"
      width={dim} height={dim} viewBox={`0 0 ${ico.width || 256} ${ico.height || 256}`}
      fill="currentColor" style={style} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ico.body }}
    />
  );
}
window.Icon = Icon;
