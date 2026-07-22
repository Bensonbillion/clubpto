import { useRef } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";
import playersDuo from "@/assets/players-duo.jpg";
import courtAction from "@/assets/court-action.jpg";
import groupPhoto from "@/assets/group-photo.jpg";
import padelDetail from "@/assets/padel-detail.jpg";

const photos = [
  gallery1,
  playersDuo,
  courtAction,
  gallery2,
  groupPhoto,
  gallery3,
  padelDetail,
  gallery4,
];

const Wall = () => {
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0 });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !railRef.current) return;
    drag.current = {
      down: true,
      startX: e.clientX,
      scrollLeft: railRef.current.scrollLeft,
    };
    railRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.down || !railRef.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) railRef.current.classList.add("is-dragging");
    railRef.current.scrollLeft = drag.current.scrollLeft - dx;
  };

  const endDrag = () => {
    drag.current.down = false;
    railRef.current?.classList.remove("is-dragging");
  };

  return (
    <section className="rly-wall">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="rly-wall__head"
      >
        <div>
          <p className="rly-kicker">
            <span className="rly-dot" /> The wall
          </p>
          <h2 className="rly-display rly-wall__title">
            Real <span className="rly-script">nights.</span>
          </h2>
        </div>
        <span className="rly-wall__hint">Drag to explore →</span>
      </motion.div>

      <div
        ref={railRef}
        className="rly-wall__rail"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {photos.map((src) => (
          <figure key={src} className="rly-wall__item">
            <img src={src} alt="" loading="lazy" draggable={false} />
          </figure>
        ))}
      </div>
    </section>
  );
};

export default Wall;
