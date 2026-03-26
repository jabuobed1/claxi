import { useEffect, useMemo, useState } from 'react';
import {
  subscribeToAvailableRequests,
  subscribeToStudentRequests,
  subscribeToTutorClasses,
} from '../services/classRequestService';

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

export function useAvailableRequests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeToAvailableRequests((items) => {
      setRequests(items);
      setIsLoading(false);
    });

    return () => unsub?.();
  }, []);

  return { requests, isLoading };
}

export function useTutorClasses(tutorId) {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) {
      setClasses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToTutorClasses(tutorId, (items) => {
      setClasses(items);
      setIsLoading(false);
    });

    return () => unsub?.();
  }, [tutorId]);

  const upcoming = useMemo(
    () => classes.filter((item) => item.status === 'accepted' || item.status === 'in_progress'),
    [classes],
  );

  return { classes, upcoming, isLoading };
}
