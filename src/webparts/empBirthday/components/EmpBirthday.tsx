import * as React from "react";
import styles from "./EmpBirthday.module.scss";

import { IEmpBirthdayProps } from "./IEmpBirthdayProps";
import { IBirthday } from "./IBirthday";

import BirthdayService from "../services/BirthdayService";
import { formatBirthday } from "../helpers/BirthdayHelper";

import { MdEmail } from "react-icons/md";
import { FaBirthdayCake } from "react-icons/fa";

export default function EmpBirthday(props: IEmpBirthdayProps) {
  const [birthdays, setBirthdays] = React.useState<IBirthday[]>([]);

  React.useEffect(() => {
    const loadData = async () => {
      const service = new BirthdayService(props.sp, props.graph);
      const data = await service.getBirthdays(props.listName, props.daysAhead);
      setBirthdays(data);
    };

    loadData();
  }, [props.listName, props.daysAhead]);

  return (
    <div className={styles.host}>
      <div className={styles.scrollRow}>
        {birthdays.length === 0 && (
          <div className={styles.noData}>No upcoming birthdays found.</div>
        )}

        {birthdays.map(b => {
          const formatted = formatBirthday(b.Birthday);

          return (
            <div
              key={b.Email}
              className={`${styles.cardContainer} ${formatted.isToday ? styles.todayCard : ""}`}
              style={{ backgroundImage: `url(${props.backgroundImage})` }}
            >
              <div className={styles.cardContent}>
                <div className={styles.headerText}>Happy Birthday!</div>

                <div className={styles.profileImageWrapper}>
                  <img src={b.PhotoUrl} alt={b.Title} />
                </div>

                <div className={styles.nameText}>{b.Title}</div>
                <div className={styles.jobTitle}>{b.JobTitle}</div>

                <div className={styles.birthDate}>{formatted.label}</div>
              </div>

              <div className={styles.footerBar}>
                <div
                  className={styles.iconBtn}
                  onClick={() => window.location.href = `mailto:${b.Email}`}
                >
                  <MdEmail size={26} color="#1d4fa8" />
                </div>

                <div className={styles.iconBtn}>
                  <FaBirthdayCake size={26} color="#e63946" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
