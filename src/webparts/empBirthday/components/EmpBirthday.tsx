import * as React from "react";
import styles from "./EmpBirthday.module.scss";

import { IEmpBirthdayProps } from "./IEmpBirthdayProps";
import { IBirthday } from "./IBirthday";

import BirthdayService from "../services/BirthdayService";

import { MdEmail } from "react-icons/md";
import { FaBirthdayCake, FaTrophy } from "react-icons/fa";

import placeholderImage from "../assets/user_profile.png";
import teamsIcon from "../assets/teams_icon.png";

import { formatBirthday } from "../helpers/BirthdayHelper";
import { formatAnniversary, formatYearsCompleted } from "../helpers/AnniversaryHelper";

import EventModal from "./EventModal";

export default function EmpBirthday(props: IEmpBirthdayProps) {

  const [events, setEvents] = React.useState<IBirthday[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = React.useState<IBirthday | null>(null);

  React.useEffect(() => {
    const loadData = async () => {

      const service = new BirthdayService(props.sp, props.graph);

      const allEvents = await service.getAllEvents(
        props.listName,
        props.daysAhead
      );

      let filtered = allEvents;

      // APPLY FILTER
      if (props.eventFilter === "birthday") {
        filtered = allEvents.filter((e) => !e.IsAnniversary);
      }
      if (props.eventFilter === "anniversary") {
        filtered = allEvents.filter((e) => e.IsAnniversary);
      }

      setEvents(filtered);
      setLoading(false);
    };

    loadData();
  }, [props.listName, props.daysAhead, props.eventFilter]);

  // ----------------------------------------------------
  // LOADING SHIMMER
  // ----------------------------------------------------
  if (loading) {
    return (
      <div className={styles.host}>
        <div className={styles.scrollRow}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.cardContainer}>
              <div className={styles.cardContent}>
                <div className={styles.shimmerHeader}></div>
                <div className={styles.shimmerCircle}></div>
                <div className={styles.shimmerLine}></div>
                <div className={styles.shimmerLineShort}></div>
                <div className={styles.shimmerLineShort}></div>
              </div>

              <div className={styles.footerBar}>
                <div className={styles.shimmerIcon}></div>
                <div className={styles.shimmerIcon}></div>
                <div className={styles.shimmerIcon}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // NORMAL RENDER
  // ----------------------------------------------------
  return (
    <div className={styles.host}>

      <div className={styles.scrollRow}>

        {events.length === 0 && (
          <div className={styles.noData}>
            No upcoming events found for the selected filter.
          </div>
        )}

        {events.map((p) => {
          const isAnniv = p.IsAnniversary;

          return (
            <div
              key={p.Email + (isAnniv ? "-anniv" : "-bday")}
              onClick={() => setSelectedEvent(p)}
              className={`${styles.cardContainer} ${p.IsToday ? styles.todayGlow : ""}`}
              style={{ backgroundImage: `url(${props.backgroundImage})` }}
            >

              <div className={styles.cardContent}>

                {/* Title */}
                <div className={styles.headerText}>
                  {isAnniv ? "Happy Workiversary!" : "Happy Birthday!"}
                </div>

                {/* Image */}
                <div className={styles.profileImageWrapper}>
                  <img
                    src={p.PhotoUrl || placeholderImage}
                    alt={p.Title || ""}
                  />
                </div>

                {/* Name / Job */}
                <div className={styles.nameText}>{p.Title}</div>
                <div className={styles.jobTitle}>{p.JobTitle || ""}</div>

                {/* Date */}
                <div className={styles.birthDate}>
                  {isAnniv
                    ? formatAnniversary(p.HireDate!)
                    : formatBirthday(p.Birthday!)
                  }
                </div>

                {/* Years Completed */}
                {isAnniv && (
                  <div className={styles.yearsCompleted}>
                    {formatYearsCompleted(p.YearsCompleted!)}
                  </div>
                )}

              </div>

              {/* FOOTER ICON BAR */}
              <div className={styles.footerBar}>

                {/* Email */}
                <div
                  className={styles.iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `mailto:${p.Email}`;
                  }}
                >
                  <MdEmail size={26} color="#1d4fa8" />
                </div>

                {/* Teams Chat */}
                <div
                  className={styles.iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://teams.microsoft.com/l/chat/0/0?users=${p.Email}`,
                      "_blank"
                    );
                  }}
                >
                  <img src={teamsIcon} alt="Chat in Teams" style={{ width: 26, height: 26 }} />
                </div>

                {/* Badge Icon */}
                <div className={styles.iconBtn}>
                  {isAnniv ? (
                    <FaTrophy size={26} color="#c49b00" />
                  ) : (
                    <FaBirthdayCake size={26} color="#e63946" />
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* -------------------- MODAL (OUTSIDE MAP!) -------------------- */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          placeholderImage={placeholderImage}
          backgroundImage={props.backgroundImage}
        />
      )}

    </div>
  );
}
