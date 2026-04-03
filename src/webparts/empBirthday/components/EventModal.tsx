import * as React from "react";
import styles from "./EventModal.module.scss";
import { IEventModalProps } from "./IEventModalProps";
import { MdEmail } from "react-icons/md";
import { FaBirthdayCake, FaTrophy, FaUserPlus } from "react-icons/fa";
import { SiMicrosoftteams } from "react-icons/si";
import confetti from "canvas-confetti";
import { formatBirthday } from "../helpers/BirthdayHelper";
import { formatAnniversary } from "../helpers/AnniversaryHelper";
import { formatDaysOnTeam, formatNewHireDate } from "../helpers/NewHireHelper";
import { getInitials } from "../helpers/VisualHelper";

const themeClassNames = {
  simple: styles.themeSimple,
  celebration: styles.themeCelebration,
  sunrise: styles.themeSunrise,
  meadow: styles.themeMeadow,
  royal: styles.themeRoyal
};

export default function EventModal({
  event,
  onClose,
  backgroundVariant
}: IEventModalProps): React.ReactElement {

  const isAnniversary = Boolean(event.IsAnniversary);
  const isNewHire = Boolean(event.IsNewHire);
  const canContact = Boolean(event.Email?.trim());
  const themeClassName = themeClassNames[backgroundVariant];

  React.useEffect(() => {
    if (!event.IsToday) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      Promise.resolve(confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.3 }
      })).catch((error) => {
        console.error("Failed to render celebration confetti.", error);
      });

      Promise.resolve(confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.7 }
      })).catch((error) => {
        console.error("Failed to render celebration confetti.", error);
      });
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [event.IsToday]);

  const eventTitle = isNewHire
    ? "Welcome Aboard!"
    : isAnniversary
      ? "Happy Workiversary!"
      : "Happy Birthday!";
  const dateText = isNewHire
    ? formatNewHireDate(event.HireDate!)
    : isAnniversary
      ? formatAnniversary(event.HireDate!)
      : formatBirthday(event.Birthday!);
  const supportingText = isNewHire
    ? formatDaysOnTeam(event.DaysSinceHire ?? 0)
    : isAnniversary
      ? event.YearsCompleted
        ? `Celebrating ${event.YearsCompleted} years`
        : ""
      : "";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modalBox} ${themeClassName}`}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className={styles.modalBackdrop} />

        <div className={styles.closeBtn} onClick={onClose}>
          ×
        </div>

        <div className={styles.photoWrapper}>
          {event.PhotoUrl?.trim() ? (
            <img
              src={event.PhotoUrl}
              alt={event.Title || ""}
            />
          ) : (
            <div className={styles.photoFallback}>
              {getInitials(
                event.Title,
                isNewHire ? "NH" : isAnniversary ? "WA" : "HB"
              )}
            </div>
          )}
        </div>

        <div className={styles.eventTitle}>
          {eventTitle}
        </div>

        <div className={styles.nameText}>{event.Title}</div>
        <div className={styles.jobTitle}>{event.JobTitle || ""}</div>

        <div className={styles.dateText}>
          {dateText}
        </div>

        {supportingText && (
          <div className={`${styles.yearsText} ${isNewHire ? styles.supportTextNewHire : ""}`}>
            {supportingText}
          </div>
        )}

        <div className={styles.modalFooter}>
          <div
            className={`${styles.iconBtn} ${!canContact ? styles.iconBtnDisabled : ""}`}
            onClick={() => {
              if (!canContact) {
                return;
              }

              window.location.href = `mailto:${event.Email}`;
            }}
          >
            <MdEmail size={28} color={canContact ? "#1d4fa8" : "#9aa7bf"} />
          </div>

          <div
            className={`${styles.iconBtn} ${!canContact ? styles.iconBtnDisabled : ""}`}
            onClick={() => {
              if (!canContact) {
                return;
              }

              window.open(
                `https://teams.microsoft.com/l/chat/0/0?users=${event.Email}`,
                "_blank"
              );
            }}
          >
            <SiMicrosoftteams size={26} color={canContact ? "#5b5fc7" : "#9aa7bf"} />
          </div>

          <div className={styles.iconBtn}>
            {isNewHire ? (
              <FaUserPlus size={26} color="#1f9d6a" />
            ) : isAnniversary ? (
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
