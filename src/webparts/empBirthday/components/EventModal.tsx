import * as React from "react";
import styles from "./EventModal.module.scss";
import { IEventModalProps } from "./IEventModalProps";
import { MdEmail } from "react-icons/md";
import { FaBirthdayCake, FaTrophy } from "react-icons/fa";
import confetti from "canvas-confetti";
import { formatBirthday } from "../helpers/BirthdayHelper";
import { formatAnniversary } from "../helpers/AnniversaryHelper";
import teamsIcon from "../assets/teams_icon.png";

export default function EventModal({
  event,
  onClose,
  placeholderImage,
  backgroundImage
}: IEventModalProps) {

  const isAnniv = event.IsAnniversary;

  // -----------------------
  // CONFETTI FOR TODAY ONLY
  // -----------------------
  React.useEffect(() => {
    if (event.IsToday) {
      setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.3 }
        });

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.7 }
        });
      }, 200);
    }
  }, [event]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalBox}
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Close Button */}
        <div className={styles.closeBtn} onClick={onClose}>
          ×
        </div>

        {/* Photo */}
        <div className={styles.photoWrapper}>
          <img
            src={event.PhotoUrl || placeholderImage}
            alt={event.Title || ""}
          />
        </div>

        {/* Header */}
        <div className={styles.eventTitle}>
          {isAnniv ? "Happy Workiversary!" : "Happy Birthday!"}
        </div>

        {/* Name */}
        <div className={styles.nameText}>{event.Title}</div>

        {/* Job Title */}
        <div className={styles.jobTitle}>{event.JobTitle || ""}</div>

        {/* Date */}
        <div className={styles.dateText}>
          {isAnniv
            ? formatAnniversary(event.HireDate!)
            : formatBirthday(event.Birthday!)
          }
        </div>

        {/* Years (Workiversary) */}
        {isAnniv && (
          <div className={styles.yearsText}>
            Celebrating {event.YearsCompleted} years
          </div>
        )}

        {/* Footer */}
        <div className={styles.modalFooter}>
          {/* Email */}
          <div
            className={styles.iconBtn}
            onClick={() => (window.location.href = `mailto:${event.Email}`)}
          >
            <MdEmail size={28} color="#1d4fa8" />
          </div>

          {/* Teams */}
          <div
            className={styles.iconBtn}
            onClick={() =>
              window.open(
                `https://teams.microsoft.com/l/chat/0/0?users=${event.Email}`,
                "_blank"
              )
            }
          >
            <img
              src={teamsIcon}
              alt="Teams Chat"
              style={{ width: 28, height: 28 }}
            />
          </div>

          {/* Trophy / Cake */}
          <div className={styles.iconBtn}>
            {isAnniv ? (
              <FaTrophy size={28} color="#c49b00" />
            ) : (
              <FaBirthdayCake size={28} color="#e63946" />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
