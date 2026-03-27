import { useEffect, useMemo, useState } from 'react';
import {
  subscribeToStudentRequests,
  subscribeToTutorAcceptedRequests,
  subscribeToTutorAvailableRequests,
} from '../services/classRequestService';
import { REQUEST_STATUSES } from '../utils/requestStatus';

export function useStudentRequests(studentId) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToStudentRequests(studentId, (items) => {
      setRequests(items);
      setIsLoading(false);
    });

    return () => unsub?.();
  }, [studentId]);

  return { requests, isLoading };
}

export function useTutorAvailableRequests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeToTutorAvailableRequests((items) => {
      setRequests(items);
      setIsLoading(false);
    });

    return () => unsub?.();
  }, []);

  return { requests, isLoading };
}

export function useTutorAcceptedRequests(tutorId) {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) {
      setClasses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToTutorAcceptedRequests(tutorId, (items) => {
      setClasses(items);
      setIsLoading(false);
    });

    return () => unsub?.();
  }, [tutorId]);

  const upcoming = useMemo(
    () =>
      classes.filter((item) =>
        [REQUEST_STATUSES.ACCEPTED, REQUEST_STATUSES.SCHEDULED, REQUEST_STATUSES.IN_PROGRESS].includes(item.status),
      ),
    [classes],
  );

  return { classes, upcoming, isLoading };
}
