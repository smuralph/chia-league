// Filenames match team_images/ exactly as the user supplied them (last-name
// based). Any owner not in this map falls back to initials in <Avatar>.
const AVATAR_FILES: Record<string, string> = {
  "Albert Martinez": "amartinez.png",
  "Chris Devlin": "devlin.jpg",
  "Chris Varughese": "varughese.png",
  "Daniel Murray": "dmurray.png",
  "Dario Lopez": "lopez.jpg",
  "Ernie Meza": "meza.jpg",
  "Marco De Leon": "deleon.jpg",
  "Misael Rubio": "rubio.jpg",
  "Rafael Guevara": "guevara.jpg",
  "Rito Guia": "guia.jpg",
  "Robert Tinajero": "tinajero.jpg",
  "Roger Torres": "torres.png",
};

export function getAvatarPath(owner: string): string | null {
  const file = AVATAR_FILES[owner];
  return file ? `/avatars/${file}` : null;
}

export function getInitials(owner: string): string {
  return owner
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function slugifyOwner(owner: string): string {
  return owner
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
