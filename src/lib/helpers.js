import { AVATAR_PALETTE } from "../theme";

export const ini = (n) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const playerColor = (group, p) =>
  AVATAR_PALETTE[group.indexOf(p) % AVATAR_PALETTE.length];
