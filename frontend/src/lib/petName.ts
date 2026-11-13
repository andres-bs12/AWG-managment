/** A paid back name doubles as the pet's name, written the way it is lettered: "LUNA" -> "Luna". */
export function petNameFromBack(backName: string): string {
  const name = backName.trim()
  return name ? name.charAt(0).toLocaleUpperCase() + name.slice(1).toLocaleLowerCase() : ''
}
