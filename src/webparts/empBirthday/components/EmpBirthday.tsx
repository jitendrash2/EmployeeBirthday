import * as React from "react";
import styles from "./EmpBirthday.module.scss";

import { IEmpBirthdayProps } from "./IEmpBirthdayProps";
import { IBirthday } from "./IBirthday";

import BirthdayService from "../services/BirthdayService";

import { MdEmail } from "react-icons/md";
import { FaBirthdayCake, FaTrophy } from "react-icons/fa";

import placeholderImage from "../assets/user_profile.png";

import { formatBirthday } from "../helpers/BirthdayHelper";
import {
  formatAnniversary,
  formatYearsCompleted
} from "../helpers/AnniversaryHelper";

export default function EmpBirthday(props: IEmpBirthdayProps) {

  const [events, setEvents] = React.useState<IBirthday[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    const loadData = async () => {
      const service = new BirthdayService(props.sp, props.graph);

      // Load FULL list of events (birthdays + anniversaries)
      const allEvents = await service.getAllEvents(
        props.listName,
        props.daysAhead
      );

      let filtered = allEvents;

      // ----------------------------
      // APPLY EVENT FILTER
      // ----------------------------
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

  }, [props.listName, props.daysAhead, props.eventFilter]); // include new filter


  if (loading) {
  return (
    <div className={styles.host}>
      <div className={styles.scrollRow}>

        {/* 3 shimmer placeholder cards */}
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.cardContainer}>
            
            <div className={styles.cardContent}>

              {/* Header placeholder */}
              <div className={styles.shimmerHeader}></div>

              {/* Profile circle */}
              <div className={styles.shimmerCircle}></div>

              {/* Name */}
              <div className={styles.shimmerLine}></div>

              {/* Job title */}
              <div className={styles.shimmerLineShort}></div>

              {/* Date */}
              <div className={styles.shimmerLineShort}></div>

            </div>

            {/* Footer Icons */}
            <div className={styles.footerBar}>
              <div className={styles.shimmerIcon}></div>
              <div className={styles.shimmerIcon}></div>
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}

  return (
  <div className={styles.host}>

    {/* ------------------- WEBPART TITLE ------------------- */}
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
            className={`${styles.cardContainer} ${p.IsToday ? styles.todayGlow : ""}`}
            style={{
              backgroundImage: `url(${props.backgroundImage})`
            }}
          >

            {/* ---------------------- CONTENT ---------------------- */}
            <div className={styles.cardContent}>

              <div className={styles.headerText}>
                {isAnniv ? "Happy Workiversary!" : "Happy Birthday!"}
              </div>

              <div className={styles.profileImageWrapper}>
                <img
                  src={p.PhotoUrl || placeholderImage}
                  alt={p.Title ?? ""}
                />
              </div>

              <div className={styles.nameText}>{p.Title}</div>
              <div className={styles.jobTitle}>{p.JobTitle ?? ""}</div>

              <div className={styles.birthDate}>
                {isAnniv
                  ? formatAnniversary(p.HireDate!)
                  : formatBirthday(p.Birthday!)
                }
              </div>

              {isAnniv && (
                <div className={styles.yearsCompleted}>
                  {formatYearsCompleted(p.YearsCompleted!)}
                </div>
              )}

            </div>

            {/* ---------------------- FOOTER ----------------------- */}
            <div className={styles.footerBar}>

              <div
                className={styles.iconBtn}
                onClick={() => (window.location.href = `mailto:${p.Email}`)}
              >
                <MdEmail size={26} color="#1d4fa8" />
              </div>

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
  </div>
);
}
