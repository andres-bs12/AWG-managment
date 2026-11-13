import { Cyclist, LampElf, Reindeer, Snowman, WalkingElf, WalkingNeighbour, WavingElf, Yeti } from './FlatFolk'
import { CottageHouse, Fir, GingerHouse, Sled, Snowballs, StarTree } from './FlatTown'
import styles from './VillageStreet.module.css'

/**
 * The street the stall stands on. It gives the home scene one clear ground line: houses sit on the
 * back pavement either side of the stall, villagers use the pavements and the road, and the snow
 * in front stays clear for the buttons. Must be rendered full-bleed right under the stall.
 */
export function VillageStreet() {
  return (
    <div className={styles.street} aria-hidden="true">
      {/*
        Back rows, standing on the far pavement beside the stall (desktop only). Each row fills the
        free space on its side and shrinks its pieces evenly if they don't fit.
      */}
      <div className={`${styles.row} ${styles.rowLeft}`}>
        <CottageHouse className={styles.houseSmall} />
        <GingerHouse className={styles.house} />
        <Fir className={styles.fir} />
        <LampElf className={styles.lamp} />
      </div>
      <div className={`${styles.row} ${styles.rowRight}`}>
        <WavingElf className={styles.elf} />
        <StarTree className={styles.starTree} />
        <CottageHouse className={styles.house} />
        <GingerHouse className={styles.houseSmall} />
      </div>

      <div className={styles.pavementBack} />
      <div className={styles.road} />
      <div className={styles.pavementFront} />

      <div className={`${styles.lane} ${styles.laneBack}`}>
        <div className={styles.walkElf}>
          <WalkingElf className={styles.figure} />
        </div>
      </div>
      <div className={`${styles.lane} ${styles.laneRoad}`}>
        <div className={styles.cycle}>
          <Cyclist className={styles.figure} />
        </div>
      </div>
      <div className={`${styles.lane} ${styles.laneFront}`}>
        <div className={styles.walkNeighbour}>
          <WalkingNeighbour className={styles.figure} />
        </div>
      </div>

      {/*
        Front snow, kept to the far sides so the buttons in the middle stay clear. Two small
        stories instead of filler plants: a child finishing the snowman, and the sled being loaded.
      */}
      <div className={`${styles.front} ${styles.frontLeft}`}>
        <Fir className={`${styles.firFront} ${styles.wide}`} />
        <Fir className={styles.firFront} />
        <Snowballs className={styles.snowballs} />
        <Snowman className={styles.snowman} />
        <WavingElf className={styles.kid} coat="#4a7ab5" coatShade="#2f5c94" />
      </div>
      <div className={`${styles.front} ${styles.frontRight}`}>
        <Yeti className={styles.yeti} />
        <Sled className={styles.sled} />
        <Reindeer className={styles.reindeer} />
        <Fir className={`${styles.firFront} ${styles.wide}`} />
      </div>
    </div>
  )
}
