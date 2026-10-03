/**
 * The board as a sheet of paper that has been rolled up and is laid out flat: under the
 * player it lies flat, and towards a side of the screen where it does not fit it curls up
 * and goes on as a wall, like the inside of a cylinder. What the screen has no room for is
 * not left out: it stands up on that wall, turned towards the player.
 *
 * A curl is seen in section, across the screen. `d` is how far a point of the sheet lies from
 * the player along the sheet; the curl says how far across the screen it is then, how high it
 * has risen, and how steep the sheet is there. Lengths along the sheet stay as they are: the
 * sheet is bent, not stretched.
 */
export interface Curl {
  /** The sheet is flat as far as this from the player. */
  flat: number;
  /** Radius of the curl that follows. */
  radius: number;
  /** The steepest the sheet gets, in radians: it goes on at this angle as a wall. 0 is a sheet that lies flat. */
  wall: number;
}

/** Where a point of the sheet is: across the screen from the player, above the floor, and how steep the sheet is there. */
export interface CurlPoint {
  along: number;
  up: number;
  angle: number;
}

/** The least radius a curl is ever given: a fold, where the sheet cannot be fitted otherwise. */
const FOLD = 0.05;
const STEPS = 40;

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/** A point of the sheet at the distance `d` from the player, along the sheet. */
export function curlAt(curl: Curl, d: number): CurlPoint {
  const { flat, radius, wall } = curl;
  if (d <= flat || !(wall > 0)) return { along: d, up: 0, angle: 0 };
  const turn = (d - flat) / radius;
  if (turn <= wall) return { along: flat + radius * Math.sin(turn), up: radius * (1 - Math.cos(turn)), angle: turn };
  const past = d - flat - radius * wall;
  return {
    along: flat + radius * Math.sin(wall) + past * Math.cos(wall),
    up: radius * (1 - Math.cos(wall)) + past * Math.sin(wall),
    angle: wall,
  };
}

/** The angle whose sine is `share` of it: how far a curl turns for its chord to be that share of its length. */
function turnFor(share: number, most: number): number {
  let low = 0;
  let high = most;
  for (let i = 0; i < STEPS; i++) {
    const mid = (low + high) / 2;
    if (Math.sin(mid) / mid > share) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * The curl that brings the edge of the board to the edge of the screen. `reach` is how far
 * the board goes on from the player towards that side, along the sheet; `room` is how much of
 * it the screen shows there with the sheet flat.
 *
 * The sheet stays flat for the share `flatShare` of the room, then curls. A board that only
 * just fails to fit curls a little and stops at its edge; one that fails by much curls up to
 * the angle `steepest` and goes on as a wall. The curl is never tighter than `tightest`: the
 * dice on it are pressed together at the top by as much as it is tight, so where it would
 * be, the flat part gives way instead.
 */
export function curlFit(reach: number, room: number, flatShare: number, steepest: number, tightest: number): Curl {
  if (!(room > 0) || !(reach > room)) return { flat: Math.max(reach, 0), radius: 1, wall: 0 };
  const wall = clamp(steepest, 0.05, 1.5);
  const cos = Math.cos(wall);
  const sin = Math.sin(wall);
  // What a whole curl of the radius 1 takes off the width, against a wall from the start.
  const gain = sin - wall * cos;

  const fit = (flat: number): Curl => {
    const share = (room - flat) / (reach - flat);
    // Not much to take off: a part of the curl is enough, and the sheet ends before it is a wall.
    if (share >= sin / wall) {
      const turn = turnFor(share, wall);
      return { flat, radius: (reach - flat) / turn, wall: turn };
    }
    return { flat, radius: (room - flat - (reach - flat) * cos) / gain, wall };
  };

  const wanted = clamp(flatShare, 0, 0.95) * room;
  const asked = fit(wanted);
  if (asked.radius >= tightest) return asked;
  const open = fit(0);
  // No flat part at all, and the curl is still tighter than asked: it is taken as it comes.
  if (open.radius <= tightest) return { ...open, radius: Math.max(open.radius, FOLD) };
  let low = 0;
  let high = wanted;
  for (let i = 0; i < STEPS; i++) {
    const mid = (low + high) / 2;
    if (fit(mid).radius > tightest) low = mid;
    else high = mid;
  }
  return fit(low);
}

/**
 * The same in a shader. `curlPoint` gives, for a distance along the sheet and a curl as
 * (flat, radius, wall), the place across, the height, and the angle of the sheet.
 */
export const CURL_GLSL = /* glsl */ `
vec3 curlPoint(float d, vec3 curl) {
  float level = curl.x;
  float radius = curl.y;
  float wall = curl.z;
  if (d <= level || wall <= 0.0) return vec3(d, 0.0, 0.0);
  float turn = (d - level) / radius;
  if (turn <= wall) return vec3(level + radius * sin(turn), radius * (1.0 - cos(turn)), turn);
  float past = d - level - radius * wall;
  return vec3(level + radius * sin(wall) + past * cos(wall), radius * (1.0 - cos(wall)) + past * sin(wall), wall);
}
`;
