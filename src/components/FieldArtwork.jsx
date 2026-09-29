import { BRAND, fieldWash } from "../theme";

/**
 * FieldArtwork — the portrait pitch behind a slot grid (Jogar + Home):
 * the landscape brand artwork rotated 90° plus a theme-aware wash so text
 * on top stays readable. Parent must be position:relative + overflow:hidden.
 */
export default function FieldArtwork() {
  return (
    <>
      <img src={BRAND.field} alt="" aria-hidden="true" style={{
        position: "absolute", top: "50%", left: "50%", width: "177.78%", aspectRatio: "16 / 9",
        transform: "translate(-50%, -50%) rotate(90deg)", objectFit: "cover",
        filter: "brightness(1.5) contrast(1.15)", pointerEvents: "none",
      }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: fieldWash(0.3, 0.5), pointerEvents: "none" }} />
    </>
  );
}
